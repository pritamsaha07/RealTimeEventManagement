require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const http = require("http");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
  tlsInsecure: false,
};

const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    console.log("Retrying connection in 5 seconds...");
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected from MongoDB");
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  attendees: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Token expired" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    status: "ok",
    timestamp: new Date(),
    database: dbState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      name,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const events = await Event.find(query)
      .populate("creator", "name email")
      .populate("attendees", "name email")
      .sort({ date: 1 })
      .exec();

    res.json(events);
  } catch (error) {
    console.error("Fetch events error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create Event
app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    const { title, description, date, category } = req.body;

    // Validation
    if (!title || !date || !category) {
      return res
        .status(400)
        .json({ error: "Title, date, and category are required" });
    }

    // Create event
    const event = new Event({
      title,
      description,
      date: new Date(date),
      category,
      creator: req.user._id,
    });

    await event.save();

    // Populate event details
    const populatedEvent = await Event.findById(event._id)
      .populate("creator", "name email")
      .populate("attendees", "name email")
      .exec();

    // Emit socket event
    io.emit("newEvent", populatedEvent);

    res.status(201).json(populatedEvent);
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join Event
app.post("/api/events/:eventId/join", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    // Check existing attendance
    const existingAttendance = await Event.findOne({
      attendees: userId,
    }).exec();

    if (existingAttendance) {
      return res.status(400).json({
        error: "You are already attending another event",
      });
    }

    // Find and update event
    const event = await Event.findById(eventId).exec();
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (!event.attendees.includes(userId)) {
      event.attendees.push(userId);
      await event.save();
    }

    // Populate event details
    const populatedEvent = await Event.findById(eventId)
      .populate("creator", "name email")
      .populate("attendees", "name email")
      .exec();

    // Emit socket event
    io.emit("eventUpdated", {
      eventId,
      attendees: populatedEvent.attendees,
    });

    res.json(populatedEvent);
  } catch (error) {
    console.error("Join event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Leave Event
app.post("/api/events/:eventId/leave", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    // Find and update event
    const event = await Event.findById(eventId).exec();
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    event.attendees = event.attendees.filter(
      (attendeeId) => attendeeId.toString() !== userId.toString()
    );
    await event.save();

    // Populate event details
    const populatedEvent = await Event.findById(eventId)
      .populate("creator", "name email")
      .populate("attendees", "name email")
      .exec();

    // Emit socket event
    io.emit("eventUpdated", {
      eventId,
      attendees: populatedEvent.attendees,
    });

    res.json(populatedEvent);
  } catch (error) {
    console.error("Leave event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Socket.io Connection Handler
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    server.close(() => {
      console.log("Server closed. Database instance disconnected");
      process.exit(0);
    });
  } catch (err) {
    console.error("Error during graceful shutdown:", err);
    process.exit(1);
  }
});
