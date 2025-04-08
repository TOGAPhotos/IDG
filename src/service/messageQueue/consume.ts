import { MessageQueueConnection, MessageQueueWorker } from "./basic.js";
import type { MessageHandler } from "./type.js";
import Logger from '../../components/loger.js';
import HandlerError from "./erroe.js";

export default class MessageQueueConsumer extends MessageQueueWorker {

    static connection = new MessageQueueConnection();
    private consumerTag: string | null = null;
    private messageHandler: MessageHandler;

    constructor(queue: string, connection: MessageQueueConnection = MessageQueueConsumer.connection) {
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
            } catch (e) {
                if (e instanceof HandlerError) {
                    this.channel.getChannel().nack(msg, false, false);
                } else {
                    this.channel.getChannel().nack(msg, false, true);
                }
                Logger.error(`消息处理失败` + e);
                return;
            }
        }

        if (!this.checkChannel()) {
            await this.createChanel();
        }

        if (this.consumerTag === null) {
            let { consumerTag } = await this.channel.getChannel().consume(this.queue, _handler)
            this.consumerTag = consumerTag;
        } else {
            await this.channel.getChannel().consume(this.queue, _handler)
        }

    }

    async cancel() {
        if (this.consumerTag === null) {
            return;
        }
        await this.channel.getChannel().cancel(this.consumerTag);
        this.consumerTag = null;
    }

    async restart() {
        if (this.consumerTag === null) {
            await this.consume(this.messageHandler);
        }
    }

}