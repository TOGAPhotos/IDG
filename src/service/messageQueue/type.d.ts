import type { ConsumeMessage } from "amqplib";

type MessageHandler = (msg: ConsumeMessage) => Promise<void> | void;
