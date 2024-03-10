import amqplib from 'amqplib';
import Logger from "../../components/loger.js"

export class MessageQueueConnection {

    protected readonly queue: string;
    private conn: amqplib.Connection | null;

    constructor() {
        this.conn = null
    }

    async connection() {
        try {
            this.conn = await amqplib.connect(process.env.MQ_URL || 'amqp://localhost');
        } catch (e) {
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

        try {
            this.channel = await this.connection.getConnection().createChannel();
        } catch {
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

    async createChanel() {

        for (let retryTime = 0; retryTime < 3; retryTime++) {
            if (this.checkChannel()) {
                return;
            }
            await this.channel?.createChannel();
        }

        Logger.error(`消息队列链接失败\n`);
        throw new Error('消息队列链接失败');

    }

    async closeChannel() {
        if (this.checkChannel()) {
            await this.channel?.getChannel().close();
        }
    }

}