import amqplib from "amqplib";
import { MessageQueueWorker, MessageQueueConnection } from "./basic.js";

export default class MessageQueueProducer extends MessageQueueWorker {
  static connection = new MessageQueueConnection();

  constructor(
    queue: string,
    connection: MessageQueueConnection = MessageQueueProducer.connection,
  ) {
    super(queue, connection);
  }

  async send(msg: string) {
    if (!this.checkChannel()) {
      await this.createChanel();
    }
    await this.channel?.getChannel().assertQueue(this.queue);
    return this.channel?.getChannel().sendToQueue(this.queue, Buffer.from(msg));
  }
}
