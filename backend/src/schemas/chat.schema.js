const { z } = require("zod");

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(2000)
});

const chatSchema = z.object({
  body: z.object({
    messages: z.array(chatMessageSchema).min(1).max(20)
  }),
  params: z.object({}),
  query: z.object({})
});

module.exports = {
  chatSchema
};
