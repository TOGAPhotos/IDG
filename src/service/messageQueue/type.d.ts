import amqplib from "amqplib";

interface MQConsumerCallback {
    (msg: amqplib.ConsumeMessage): Promise<void> | void;
}