const express = require("express");
const validate = require("../middlewares/validate");
const { chatSchema } = require("../schemas/chat.schema");
const { postChat } = require("../controllers/chat.controller");

const router = express.Router();

router.post("/", validate(chatSchema), postChat);

module.exports = router;
