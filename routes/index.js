const express = require("express");
const router = express.Router();
const { placeRole } = require("../data/placeRole");
/* GET home page. */
router.get("/", function (req, res, next) {
  res.status(200).json({
    message: "Welcome to the API",
  });
});
router.get("/locations", function (req, res, next) {
  res.status(200).json(placeRole);
});
module.exports = router;
