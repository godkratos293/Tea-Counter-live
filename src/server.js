require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const connectDB = require("./config/db");
// const entryRoutes = require("./routes/entryRoutes");
const priceRoutes = require("./routes/priceRoutes");
const { getDateTimeDetails } = require("./utils/dateHelper");
const entryRoutes = require("./routes/entry");

const app = express();
connectDB();
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Tea Counter API Running ");
});
// app.use("/api/entries", entryRoutes);

app.use("/api/price", priceRoutes);
app.use("/api/entries", entryRoutes);

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).send(err.message || "Server Error");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
