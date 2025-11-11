const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI || "";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("HomeHero server is running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("home_hero");
    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    // Save user to database
    app.post("/users", async (req, res) => {
      const { name, email, photoURL } = req.body;

      try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(200).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne({
          name,
          email,
          photoURL,
        });
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to save user" });
      }
    });

    app.patch("/users", async (req, res) => {
      const { email, name, photoURL } = req.body;

      const updateFields = {};
      if (name) updateFields.name = name;
      if (photoURL) updateFields.photoURL = photoURL;

      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: updateFields }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update user" });
      }
    });

    // add service
    app.post("/services", async (req, res) => {
      const result = await servicesCollection.insertOne(req.body);
      res.send(result);
    });

    // get all services
    app.get("/services", async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result);
    });

    //Get Provider's Services
    app.get("/services/provider/:email", async (req, res) => {
      const result = await servicesCollection
        .find({ providerEmail: req.params.email })
        .toArray();
      res.send(result);
    });

    // update service
    app.patch("/services/:id", async (req, res) => {
      const { id } = req.params;
      const updatedService = { $set: req.body };
      const result = await servicesCollection.updateOne(
        { _id: new ObjectId(id) },
        updatedService
      );
      res.send(result);
    });

    // delete service
    app.delete("/services/:id", async (req, res) => {
      const result = await servicesCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // Book a Service
    app.post("/bookings", async (req, res) => {
      const result = await bookingsCollection.insertOne(req.body);
      res.send(result);
    });

    // Get User's Bookings
    app.get("/bookings/:email", async (req, res) => {
      const result = await bookingsCollection
        .find({ userEmail: req.params.email })
        .toArray();
      res.send(result);
    });

    // Cancel Booking
    app.delete("/bookings/:id", async (req, res) => {
      const result = await bookingsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`HomeHero server is running on port: ${port}`);
});
