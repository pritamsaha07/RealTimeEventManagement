require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const http = require("http");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/swissNoteUsers",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

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
  },
  description: String,
  date: Date,
  category: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
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
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(403).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};

app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
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
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid password" });
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
    res.status(500).json({ error: error.message });
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
      .sort({ date: 1 });

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    const event = new Event({
      ...req.body,
      creator: req.user._id,
    });

    await event.save();

    const populatedEvent = await Event.findById(event._id)
      .populate("creator", "name email")
      .populate("attendees", "name email");

    io.emit("newEvent", populatedEvent);
    res.status(201).json(populatedEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events/:eventId/join", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    // Check if user is already attending another event
    const existingAttendance = await Event.findOne({
      attendees: userId,
    });

    if (existingAttendance) {
      return res.status(400).json({
        error: "You are already attending another event",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (!event.attendees.includes(userId)) {
      event.attendees.push(userId);
      await event.save();
    }

    const populatedEvent = await Event.findById(eventId)
      .populate("creator", "name email")
      .populate("attendees", "name email");

    io.emit("eventUpdated", {
      eventId,
      attendees: populatedEvent.attendees,
    });

    res.json(populatedEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/events/:eventId/leave", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    event.attendees = event.attendees.filter(
      (attendeeId) => attendeeId.toString() !== userId.toString()
    );
    await event.save();

    const populatedEvent = await Event.findById(eventId)
      .populate("creator", "name email")
      .populate("attendees", "name email");

    io.emit("eventUpdated", {
      eventId,
      attendees: populatedEvent.attendees,
    });

    res.json(populatedEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    server.close(() => {
      console.log("Server closed. Database instance disconnected");
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
