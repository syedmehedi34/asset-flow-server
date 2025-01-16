// npx nodemon index.js

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5002;

// middleware
app.use(cors());
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
      // console.log('inside verify token', req.headers.authorization);
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
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // # users related api started
    // get all users and their role information
    // app.get("/users", async (req, res) => {
    //   const result = await userCollection.find().toArray();
    //   res.send(result);
    // });

    app.get("/users", async (req, res) => {
      const { hr_email } = req.query;
      const result = await userCollection.find({ hr_email }).toArray();

      res.send(result);
    });

    //  get unaffiliated user data, using hr_email query
    app.get("/users/:email", async (req, res) => {
      const hr_email = req.params.email;

      const query = { hr_email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    //

    // get the role data of a user
    app.get("/users/role/:email", async (req, res) => {
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
    app.patch("/users", async (req, res) => {
      const { _id, hr_email } = req.body;
      // const filter = { _id: new ObjectId(_id) };
      const filter = { _id };

      const updatedDoc = {
        $set: {
          hr_email: hr_email,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // app.patch("/users/admin/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const updatedDoc = {
    //     $set: {
    //       role: "admin",
    //     },
    //   };
    //   const result = await userCollection.updateOne(filter, updatedDoc);
    //   res.send(result);
    // });

    // app.delete("/users/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await userCollection.deleteOne(query);
    //   res.send(result);
    // });
    // # users related api ends

    //
    //
    //

    // # assets related api
    // get all the assets according to hr email
    app.get("/assets", async (req, res) => {
      const { hr_email, searchText, category } = req.query;

      // Build the query object to filter based on available parameters
      const query = { hr_email };

      // Filter by searchText if available
      if (searchText) {
        query.productName = { $regex: searchText, $options: "i" }; // Case-insensitive search
      }

      // Filter by category if available
      if (category) {
        if (["Returnable", "Non-returnable"].includes(category)) {
          query.assetType = category;
        } else if (["In Stock", "Out of Stock"].includes(category)) {
          query.productQuantity =
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

    // post a new asset in the database
    app.post("/assets", async (req, res) => {
      const assetData = req.body;
      const result = await assetCollection.insertOne(assetData);
      res.send(result);
    });

    // delete a asset
    app.delete("/assets", async (req, res) => {
      const { productId } = req.body;

      const query = { _id: new ObjectId(productId) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    // update a assets according to assetUser [insertion from the employee site asset request]
    app.patch("/assets", async (req, res) => {
      const { _id, assetUserData } = req.body;

      const query = { _id: new ObjectId(_id) };
      const update = {
        // $addToSet: { assetUser: assetUserData },
        $addToSet: { assetUser: { $each: assetUserData } }, // Add multiple, ensuring no duplicates
      };

      const result = await assetCollection.updateOne(query, update);

      // Fetch the updated document if needed for future
      // const updatedEntry = await assetCollection.findOne(query);
      res.status(200).send(result);
    });

    // update assets according to assetUser [insertion from the HR site asset approve or reject]
    app.patch("/assets", async (req, res) => {
      const { _id, assetUserData } = req.body;

      const query = { _id: new ObjectId(_id) };

      // const update = {
      //   // $addToSet: { assetUser: assetUserData },
      //   $addToSet: { assetUser: { $each: assetUserData } }, // Add multiple, ensuring no duplicates
      // };

      // const result = await assetCollection.updateOne(query, update);

      // Fetch the updated document if needed for future
      // const updatedEntry = await assetCollection.findOne(query);
      // res.status(200).send(result);
    });
    //
    //
    // app.post("/assets", async (req, res) => {
    //   const { newData } = req.body;
    //   const result = await assetCollection.insertOne(newData);
    //   res.send(result);
    // });
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
