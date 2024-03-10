import {MessageQueueConnection, MessageQueueWorker} from "./basic.js";
import {MQConsumerCallback} from "./type.js";

export default class MessageQueueConsumer extends MessageQueueWorker {

    static connection = new MessageQueueConnection();
    private consumerTag: string|null = null;
    private callback: MQConsumerCallback;

    constructor(queue: string, connection: MessageQueueConnection = MessageQueueConsumer.connection) {
        super(queue, connection);
    }

    async consume(callback: MQConsumerCallback) {
        // 存档callback
        this.callback = callback;

        // 统一应答
        const insideCallback:MQConsumerCallback = async (msg) => {
            try{
                await callback(msg);
                this.channel.getChannel().ack(msg);
            }catch{
                return;
            }
        }

        if (!this.checkChannel()) {
            await this.createChanel();
        }

        if(this.consumerTag === null){
            let {consumerTag} = await this.channel.getChannel().consume(this.queue, insideCallback)
            this.consumerTag = consumerTag;
        }else{
            await this.channel.getChannel().consume(this.queue,insideCallback)
        }

    }

    async cancel(){
        if(this.consumerTag === null){
            return;
        }
        await this.channel.getChannel().cancel(this.consumerTag);
        this.consumerTag = null;
    }

    async restart(){
        if(this.consumerTag === null){
            await this.consume(this.callback);
        }
    }

}