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
    // await client.connect();

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
      let service = req.body;

      if (typeof service.price === "string") {
        service.price = parseInt(service.price);
      }

      if (!service.reviews) {
        service.reviews = [];
      }

      try {
        const result = await servicesCollection.insertOne(service);
        res.send({ message: "Service added", insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ error: "Failed to add service" });
      }
    });

    app.post("/services/:id/review", async (req, res) => {
      const { userId, userName, rating, comment } = req.body;
      const serviceId = req.params.id;

      try {
        const service = await servicesCollection.findOne({
          _id: new ObjectId(serviceId),
        });

        if (!service) {
          return res.status(404).send({ error: "Service not found" });
        }

        // Check if user already reviewed
        const existingReview = service.reviews?.find(
          (r) => r.userId === userId
        );

        if (existingReview) {
          // Update existing review
          await servicesCollection.updateOne(
            { _id: new ObjectId(serviceId), "reviews.userId": userId },
            {
              $set: {
                "reviews.$.rating": rating,
                "reviews.$.comment": comment,
                "reviews.$.updatedAt": new Date(),
              },
            }
          );
        } else {
          // Add new review
          const newReview = {
            userId,
            userName,
            rating: rating || null,
            comment: comment || "",
            createdAt: new Date(),
          };

          await servicesCollection.updateOne(
            { _id: new ObjectId(serviceId) },
            { $push: { reviews: newReview } }
          );
        }

        // Recalculate average rating
        const updatedService = await servicesCollection.findOne({
          _id: new ObjectId(serviceId),
        });
        const reviews = updatedService.reviews || [];
        const validRatings = reviews.filter(
          (r) => typeof r.rating === "number"
        );
        const avgRating =
          validRatings.length > 0
            ? (
                validRatings.reduce((sum, r) => sum + r.rating, 0) /
                validRatings.length
              ).toFixed(1)
            : 0;

        // Update service's rating field
        await servicesCollection.updateOne(
          { _id: new ObjectId(serviceId) },
          { $set: { rating: parseFloat(avgRating) } }
        );

        res.send({ success: true, updatedRating: avgRating });
      } catch (error) {
        console.error("Review error:", error);
        res.status(500).send({ error: "Failed to submit review" });
      }
    });

    // get all services
    app.get("/services/all", async (req, res) => {
      const { min, max } = req.query;
      const query = {};

      if (min && max) {
        query.price = {
          $gte: parseInt(min),
          $lte: parseInt(max),
        };
      }

      try {
        const services = await servicesCollection.find(query).toArray();
        res.send(services);
      } catch (error) {
        console.error("Error fetching filtered services:", error);
        res.status(500).send({ error: "Failed to fetch services" });
      }
    });

    // get 6 services
    app.get("/services", async (req, res) => {
      try {
        const services = await servicesCollection.find({}).limit(6).toArray();
        res.send(services);
      } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).send({ error: "Failed to fetch services" });
      }
    });

    //Get Provider's Services
    app.get("/services/provider/:email", async (req, res) => {
      const result = await servicesCollection
        .find({ providerEmail: req.params.email })
        .toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const service = await servicesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!service)
          return res.status(404).send({ error: "Service not found" });
        res.send(service);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch service" });
      }
    });

    // app.get("/services/top-rated", async (req, res) => {
    //   try {
    //     const services = await servicesCollection.find().toArray();

    //     const rated = services
    //       .map((s) => {
    //         const ratings = Array.isArray(s.reviews)
    //           ? s.reviews
    //               .map((r) => r.rating)
    //               .filter((r) => typeof r === "number")
    //           : [];

    //         const avgRating =
    //           ratings.length > 0
    //             ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    //             : 0;

    //         return { ...s, avgRating };
    //       })
    //       .filter((s) => s.avgRating > 0)
    //       .sort((a, b) => b.avgRating - a.avgRating);

    //     const result =
    //       rated.length > 0 ? rated.slice(0, 6) : services.slice(0, 6);
    //     res.json(result);
    //   } catch (error) {
    //     console.error("Error in /services/top-rated:", error.message);
    //     res.status(500).json({ error: "Failed to fetch service" });
    //   }
    // });

    // app.get("/services/top-booked", async (req, res) => {
    //   try {
    //     const topServices = await bookingsCollection
    //       .aggregate([
    //         {
    //           $group: {
    //             _id: "$serviceId",
    //             count: { $sum: 1 },
    //           },
    //         },
    //         { $sort: { count: -1 } },
    //         { $limit: 6 },
    //         {
    //           $addFields: {
    //             serviceObjectId: {
    //               $convert: {
    //                 input: "$_id",
    //                 to: "objectId",
    //                 onError: null,
    //                 onNull: null,
    //               },
    //             },
    //           },
    //         },
    //         {
    //           $lookup: {
    //             from: "services",
    //             localField: "serviceObjectId",
    //             foreignField: "_id",
    //             as: "service",
    //           },
    //         },
    //         { $unwind: "$service" },
    //         {
    //           $addFields: {
    //             "service.bookingCount": "$count",
    //           },
    //         },
    //         {
    //           $replaceRoot: { newRoot: "$service" },
    //         },
    //       ])
    //       .toArray();

    //     res.send(topServices);
    //   } catch (error) {
    //     console.error("🔥 Aggregation error:", error);
    //     res.status(500).send({ error: "Failed to fetch service" });
    //   }
    // });

    // update service
    app.patch("/services/:id", async (req, res) => {
      const { id } = req.params;
      const { providerEmail, ...updates } = req.body;

      try {
        const result = await servicesCollection.updateOne(
          { _id: new ObjectId(id), providerEmail },
          { $set: updates }
        );

        if (result.matchedCount === 0) {
          return res.status(403).send({
            error: "Unauthorized: You can only update your own services",
          });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update service" });
      }
    });

    // delete service
    app.delete("/services/:id", async (req, res) => {
      const { id } = req.params;
      const { providerEmail } = req.query;

      try {
        const result = await servicesCollection.deleteOne({
          _id: new ObjectId(id),
          providerEmail,
        });

        if (result.deletedCount === 0) {
          return res.status(403).send({
            error: "Unauthorized: You can only delete your own services",
          });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to delete service" });
      }
    });

    // Book a Service
    app.post("/bookings", async (req, res) => {
      const { email, serviceId } = req.body;

      try {
        const service = await servicesCollection.findOne({
          _id: new ObjectId(serviceId),
        });

        if (!service) {
          return res.status(404).send({ error: "Service not found." });
        }

        if (service.providerEmail === email) {
          return res
            .status(403)
            .send({ error: "You cannot book your own service." });
        }

        const existing = await bookingsCollection.findOne({
          email,
          serviceId,
        });

        if (existing) {
          return res
            .status(409)
            .send({ error: "You already booked this service." });
        }

        const result = await bookingsCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.error("Booking error:", error);
        res.status(500).send({ error: "Failed to book service." });
      }
    });

    // Get User's Bookings
    app.get("/bookings", async (req, res) => {
      const { userEmail, serviceId } = req.query;
      const query = {};

      if (userEmail) query.email = userEmail;
      if (serviceId) query.serviceId = serviceId;

      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // Cancel Booking
    app.delete("/bookings/:id", async (req, res) => {
      const result = await bookingsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.get("/dashboard/stats", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) return res.status(400).send({ error: "Email required" });

        const servicesCount = await servicesCollection.countDocuments({
          providerEmail: email,
        });
        const bookingsCount = await bookingsCollection.countDocuments({
          email,
        });

        const services = await servicesCollection
          .find({ providerEmail: email })
          .toArray();
        const avgRating =
          services.length > 0
            ? (
                services.reduce((sum, s) => {
                  const reviewRatings =
                    s.reviews?.map((r) => r.rating || 0) || [];
                  const total = reviewRatings.reduce((a, b) => a + b, 0);
                  return (
                    sum +
                    (reviewRatings.length ? total / reviewRatings.length : 0)
                  );
                }, 0) / services.length
              ).toFixed(1)
            : 0;

        const bookingsPerMonthAgg = await bookingsCollection
          .aggregate([
            { $match: { email } },
            {
              $group: {
                _id: { $month: "$createdAt" },
                bookings: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray();

        const bookingsPerMonth = bookingsPerMonthAgg.map((d) => ({
          month: new Date(2026, d._id - 1).toLocaleString("default", {
            month: "short",
          }),
          bookings: d.bookings,
        }));

        const servicesByCategoryAgg = await servicesCollection
          .aggregate([
            { $match: { providerEmail: email } },
            {
              $group: {
                _id: "$category",
                value: { $sum: 1 },
              },
            },
          ])
          .toArray();

        const servicesByCategory = servicesByCategoryAgg.map((d) => ({
          category: d._id,
          value: d.value,
        }));

        res.send({
          services: servicesCount,
          bookings: bookingsCount,
          rating: avgRating,
          bookingsPerMonth,
          servicesByCategory,
        });
      } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).send({ error: "Failed to fetch dashboard stats" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
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
