// npx nodemon index.js

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const { ObjectId } = require("mongoose").Types; // Import ObjectId from mongoose

const port = process.env.PORT || 5002;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://asset-flow.netlify.app",
    ],
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0uhyg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("AssetFlow").collection("Employees");
    const assetCollection = client.db("AssetFlow").collection("Assets");
    const paymentCollection = client.db("AssetFlow").collection("Payments");
    const assetDistributionCollection = client
      .db("AssetFlow")
      .collection("AssetsDistribution");
    // const paymentCollection = client.db("AssetFlow").collection("payments");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      // console.log(req.decoded.email);
      if (!req.decoded) {
        return res
          .status(401)
          .send({ message: "Unauthorized: Token not provided or invalid" });
      }

      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "hr_manager";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // # payment related api started
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // insert payment to database, and update the package information
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      const query = { email: payment.email };
      const updatedDoc = {
        $set: {
          package: payment.packageId,
        },
      };

      const updateResult = await userCollection.updateOne(query, updatedDoc);
      res.send({ paymentResult, updateResult });
    });

    // # users related api started
    // * checking the user role [not necessary for now ]
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };

      const user = await userCollection.findOne(query);

      let role = "";

      if (user?.role === "hr_manager") {
        role = "hr_manager";
      }
      if (user?.role === "employee") {
        role = "employee";
      }
      res.send({ role });
    });
    //

    app.get("/users", verifyToken, async (req, res) => {
      // console.log(req.headers);  // get the token from localstorage [using secureAxios]
      const { hr_email } = req.query;

      if (hr_email === "unaffiliated@hostname.com") {
        return res.status(400).send({ message: "No data found" });
      }

      query = { hr_email };

      const result = await userCollection.find(query).toArray();

      res.send(result);
    });

    //  get unaffiliated user data, using hr_email query
    app.get("/users/:email", verifyToken, async (req, res) => {
      const hr_email = req.params.email;

      const query = { hr_email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    //

    // get the role data of a user
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // post a user data to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // update a user data [hr_email]
    app.patch("/users", verifyToken, async (req, res) => {
      const { _id, hr_email, name, photo, companyLogo } = req.body;
      // console.log(name, photo);
      const filter = { _id: new ObjectId(_id) };
      // const filter = { _id };

      let updatedDoc = {};

      if (hr_email && companyLogo && !name && !photo) {
        updatedDoc = {
          $set: {
            hr_email: hr_email,
            companyLogo: companyLogo,
          },
        };
      }

      if (name && photo) {
        updatedDoc = {
          $set: {
            name: name,
            photo: photo,
          },
        };
      }
      if (!name && photo) {
        updatedDoc = {
          $set: {
            // name: name,
            photo: photo,
          },
        };
      }

      if (name && !photo) {
        updatedDoc = {
          $set: {
            name: name,
            // photo: photo,
          },
        };
      }

      const result = await userCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    app.patch("/user", verifyToken, verifyAdmin, async (req, res) => {
      const { ids, data } = req.body;
      // console.log("Received data:", data);
      // console.log("Received ids:", ids);

      // Validate ids array
      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "IDs must be a non-empty array." });
      }

      const objectIds = ids.map((id) => new ObjectId(id));

      const result = await userCollection.updateMany(
        { _id: { $in: objectIds } },
        { $set: data }
      );

      // Send the result of the update operation
      res.send(result);
    });

    // # users related api ends

    //
    //
    //

    // # assets related api
    // get all the assets according to hr email and search by text and category
    app.get("/assets", verifyToken, async (req, res) => {
      const { hr_email, searchText, category } = req.query;

      // Build the query object to filter based on available parameters
      const query = { hr_email };

      // Filter by searchText if available
      if (searchText) {
        query.assetName = { $regex: searchText, $options: "i" }; // Case-insensitive search
      }

      // Filter by category if available
      if (category) {
        if (["Returnable", "Non-returnable"].includes(category)) {
          query.assetType = category;
        } else if (["In Stock", "Out of Stock"].includes(category)) {
          query.assetQuantity =
            category === "In Stock" ? { $gt: 0 } : { $lte: 0 }; // In Stock: quantity > 0, Out of Stock: quantity <= 0
        }
      }

      try {
        // Fetch assets based on the query parameters
        const result = await assetCollection.find(query).toArray();

        // Send the result
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch assets" });
      }
    });
    //--------------------------

    // post a new asset in the database [hr manager only can do this]
    app.post("/assets", verifyToken, verifyAdmin, async (req, res) => {
      const assetData = req.body;
      const result = await assetCollection.insertOne(assetData);
      res.send(result);
    });

    // delete a asset [hr manager only can do this]
    app.delete("/assets", verifyToken, verifyAdmin, async (req, res) => {
      const { productId } = req.body;
      const query = { _id: new ObjectId(productId) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    // patch the asset collection to return a asset, update the counting [My assets page]
    app.patch("/assets", verifyToken, async (req, res) => {
      const { assetID } = req.body;
      const filter = { _id: new ObjectId(assetID) };

      const updatedDoc = {
        $inc: {
          assetQuantity: 1,
        },
      };
      const result = await assetCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // update assets - assets data are updating from the asset list [hr only]
    app.patch("/assets_update", verifyToken, verifyAdmin, async (req, res) => {
      const { _id, updatedData } = req.body;
      // console.log(updatedData);
      const filter = { _id: new ObjectId(_id) };

      const updatedDoc = {
        $set: {
          ...updatedData,
        },
      };
      const result = await assetCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // # asset DistributionCollection collection

    // get asset distribution data according hr_mail, text search and category search
    app.get("/asset_distribution", verifyToken, async (req, res) => {
      const { hr_email, requestStatus, employeeEmail, searchText, category } =
        req.query;

      // Build the query object to filter based on available parameters
      const query = {};

      // Filter by hr_email if available
      if (hr_email) {
        query.hr_email = hr_email;
      }

      if (employeeEmail) {
        query.employeeEmail = employeeEmail;
      }

      // Filter by searchText if available
      if (searchText) {
        query.assetName = { $regex: searchText, $options: "i" }; // Case-insensitive search
      }

      // Filter by category if available
      if (category) {
        if (["Returnable", "Non-returnable"].includes(category)) {
          query.assetType = category;
        } else if (["In Stock", "Out of Stock"].includes(category)) {
          query.assetQuantity =
            category === "In Stock" ? { $gt: 0 } : { $lte: 0 }; // In Stock: quantity > 0, Out of Stock: quantity <= 0
        }
      }

      // Filter by requestStatus if available
      if (requestStatus) {
        query.requestStatus = requestStatus;
      }

      try {
        // Fetch assets based on the query parameters
        const result = await assetDistributionCollection.find(query).toArray();

        // Send the result
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch assets" });
      }
    });

    // post a new asset request from the employee route
    // todo : have to add a option for backend checking that,,,one employee can not add a single asset for multiple time at the asset request.
    app.post("/asset_distribution", async (req, res) => {
      const assetData = req.body;

      const {
        assetID,
        employeeName,
        employeeEmail,
        hr_email,

        assetRequestingDate,
        assetRequestMessage,
        assetName,
        assetType,
        assetQuantity,
        assetDescription,

        assetPostDate,
        companyName,
        requestStatus,
        approvalDate,
        cancellingDate,
        returningDate,
      } = assetData;

      const asset = {
        assetID,
        assetRequestingDate,
        assetRequestMessage,
        assetName,
        assetType,
        assetDescription,
        assetPostDate,
        companyName,
        status: "pending",
        receivingDate: "Not Received",
        returningDate: "Not Returned",
        cancellingDate: "Not Cancelled",
      };

      // 🔍 Find the employee from userCollection using both emails
      const employee = await userCollection.findOne({
        email: employeeEmail,
        hr_email: hr_email,
      });

      if (!employee) {
        return res
          .status(404)
          .send({ message: "Employee not found with provided emails" });
      }

      // 🛠️ Push assetData to employee's assets array
      await userCollection.updateOne(
        { _id: employee._id },
        { $push: { assets: asset } }
      );

      // 📦 Insert assetData into assetDistributionCollection
      const result = await assetDistributionCollection.insertOne(assetData);
      res.send(result);
    });

    // patch the [My assets page]
    app.patch("/asset_distribution", async (req, res) => {
      try {
        const {
          _id,
          requestStatus,
          approvalDate,
          assetID,
          n,

          email,
          status,
          receivingDate,
          returningDate,
        } = req.body;

        // console.log(status, receivingDate, returningDate);

        // Validate inputs for usersCollection update
        if (email && assetID && status) {
          // Validate assetID format (assuming it's stored as ObjectID)
          if (!ObjectId.isValid(assetID)) {
            return res.status(400).send({ error: "Invalid assetID format" });
          }

          // Build update object for usersCollection
          const userUpdateFields = {
            "assets.$[elem].status": status,
          };
          if (receivingDate)
            userUpdateFields["assets.$[elem].receivingDate"] = receivingDate;
          if (returningDate)
            userUpdateFields["assets.$[elem].returningDate"] = returningDate;

          // Update usersCollection
          const userFilter = { email };
          const userUpdate = {
            $set: userUpdateFields,
          };
          const userOptions = {
            arrayFilters: [{ "elem.assetID": assetID }],
          };

          const userResult = await userCollection.updateOne(
            userFilter,
            userUpdate,
            userOptions
          );

          if (userResult.matchedCount === 0) {
            return res
              .status(404)
              .send({ error: "User not found or asset not assigned to user" });
          }
        }

        // Original logic for assetDistributionCollection and assetCollection
        if (_id) {
          // Validate _id
          if (!ObjectId.isValid(_id)) {
            return res.status(400).send({ error: "Invalid _id format" });
          }

          // Update assetCollection if assetID and n are provided
          if (assetID) {
            const filterAsset = { _id: new ObjectId(assetID) };
            const asset = await assetCollection.findOne(filterAsset);

            if (!asset) {
              return res.status(404).send({ error: "Asset not found" });
            }

            // Prevent negative quantity
            if (n && asset.assetQuantity + n < 0) {
              return res
                .status(400)
                .send({ error: "Cannot reduce asset quantity below 0" });
            }

            const updatedDocAsset = {
              $inc: {
                assetQuantity: n || 0,
              },
            };

            await assetCollection.updateOne(filterAsset, updatedDocAsset);
          }

          // Update assetDistributionCollection
          const filter = { _id: new ObjectId(_id) };
          const updatedDocForAssetDistributionCollection = {
            $set: {
              requestStatus: requestStatus || null,
              approvalDate: approvalDate || null,
            },
          };

          const distributionResult =
            await assetDistributionCollection.updateOne(
              filter,
              updatedDocForAssetDistributionCollection
            );

          if (distributionResult.matchedCount === 0) {
            return res
              .status(404)
              .send({ error: "Asset distribution record not found" });
          }
        }

        // Respond with success
        res.send({
          message: "Update successful",
          userUpdated: email && assetID && status ? true : false,
          distributionUpdated: _id ? true : false,
        });
      } catch (error) {
        console.error("Error updating asset distribution:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    //
    //
    //--------------
    //
    //
    //
    //
    //
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }

  //
  //
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Project is running...");
});

app.listen(port, () => {
  console.log(`Project is sitting on port ${port}`);
});
