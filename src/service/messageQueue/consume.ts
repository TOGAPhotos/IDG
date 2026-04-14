import { MessageQueueConnection, MessageQueueWorker } from "./basic.js";
import type { MessageHandler } from "./type.js";
import Logger from "../../components/loger.js";
import HandlerError from "./error.js";

export default class MessageQueueConsumer extends MessageQueueWorker {
  static connection = new MessageQueueConnection();
  private consumerTag: string | null = null;
  private messageHandler: MessageHandler;

  constructor(
    queue: string,
    connection: MessageQueueConnection = MessageQueueConsumer.connection,
  ) {
    super(queue, connection);
  }

  async consume(handler: MessageHandler) {
    // 存档callback
    this.messageHandler = handler;

    // 统一应答
    const _handler: MessageHandler = async (msg) => {
      try {
        await this.messageHandler(msg);
        this.channel.getChannel().ack(msg);
        Logger.debug(`MQ message ack queue:${this.queue}`);
      } catch (e) {
        if (e instanceof HandlerError) {
          this.channel.getChannel().nack(msg, false, false); // drop
          Logger.warn(`MQ message dropped queue:${this.queue} err:${(e as Error).message}`);
        } else {
          this.channel.getChannel().nack(msg, false, true); // requeue
          Logger.warn(`MQ message requeue queue:${this.queue} err:${(e as Error).message}`);
        }
        Logger.error(`MQ message process failed queue:${this.queue} err:${(e as Error).message}`);
        return;
      }
    };

    if (!this.checkChannel()) {
      await this.ensureChannel();
    }

    const { consumerTag } = await this.channel
      .getChannel()
      .consume(this.queue, _handler);
    this.consumerTag = consumerTag;
    Logger.info(`MQ consumer started queue:${this.queue} tag:${consumerTag}`);
  }

  async cancel() {
    if (this.consumerTag === null) {
      return;
    }
    if (this.checkChannel()) {
      try {
        await this.channel.getChannel().cancel(this.consumerTag);
        Logger.info(
          `MQ consumer cancelled queue:${this.queue} tag:${this.consumerTag}`,
        );
      } catch (e) {
        Logger.warn(
          `MQ consumer cancel failed queue:${this.queue} err:${(e as Error).message}`,
        );
      }
    }
    this.consumerTag = null;
  }

  async restart() {
    // 若频道已断开，consumerTag 变为陈旧；强制清空后重订阅。
    if (!this.checkChannel()) {
      this.consumerTag = null;
    }
    if (this.consumerTag === null && this.messageHandler) {
      Logger.info(`MQ consumer restart queue:${this.queue}`);
      await this.consume(this.messageHandler);
    }
  }
}
