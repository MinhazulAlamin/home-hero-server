const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://homeherodbUser:BsO5QUhQt4EGYqip@cluster0.m4ciotl.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Smart server is running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("home_hero");
    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");

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

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart server is running on port: ${port}`);
});
