import amqplib from "amqplib";
import Logger from "../../components/loger.js";
import "dotenv/config";

const MQ_PREFETCH = Number(process.env.MQ_PREFETCH) || 16;

export class MessageQueueConnection {
  private conn: amqplib.ChannelModel | null;

  constructor() {
    this.conn = null;
  }

  async connection() {
    try {
      this.conn = await amqplib.connect(
        process.env.MQ_URL || "amqp://localhost",
      );
      this.conn.on("close", () => {
        Logger.warn("MQ connection closed");
        this.conn = null;
      });
      this.conn.on("error", (e) => {
        Logger.error(`MQ connection error: ${e.message}`);
        this.conn = null;
      });
      Logger.debug("MQ connection established");
    } catch (e) {
      this.conn = null;
      Logger.error(`消息队列链接失败\n ${e.message}\n${e.stack}\n`);
    }
  }

  getConnection() {
    return this.conn;
  }
}

class MessageQueueChannel {
  private connection: MessageQueueConnection;
  private channel: amqplib.Channel | null;

  constructor(connection: MessageQueueConnection) {
    this.channel = null;
    this.connection = connection;
  }

  async createChannel() {
    if (this.connection.getConnection() === null) {
      await this.connection.connection();
    }
    const conn = this.connection.getConnection();
    if (conn === null) {
      this.channel = null;
      return;
    }

    try {
      this.channel = await conn.createChannel();
      await this.channel.prefetch(MQ_PREFETCH);
      this.channel.on("close", () => {
        Logger.warn("MQ channel closed");
        this.channel = null;
      });
      this.channel.on("error", (e) => {
        Logger.error(`MQ channel error: ${e.message}`);
        this.channel = null;
      });
      Logger.info("MQ channel created");
    } catch (e) {
      Logger.error(`MQ channel create failed: ${(e as Error).message}`);
      this.channel = null;
    }
  }

  getChannel() {
    return this.channel;
  }
}

export class MessageQueueWorker {
  protected readonly queue: string;
  protected channel: MessageQueueChannel | null;

  constructor(queue: string, connection: MessageQueueConnection) {
    this.queue = queue;
    this.channel = new MessageQueueChannel(connection);
  }

  protected checkChannel() {
    return this.channel.getChannel() !== null;
  }

  async ensureChannel() {
    let lastError: unknown;
    for (let retryTime = 0; retryTime < 3; retryTime++) {
      if (this.checkChannel()) {
        return;
      }
      try {
        await this.channel?.createChannel();
      } catch (e) {
        lastError = e;
      }
      if (this.checkChannel()) {
        return;
      }
    }

    Logger.error(`消息队列链接失败\n`);
    throw new Error(
      `消息队列链接失败${lastError ? `: ${(lastError as Error).message}` : ""}`,
    );
  }

  async closeChannel() {
    if (this.checkChannel()) {
      await this.channel?.getChannel().close();
    }
  }
}
