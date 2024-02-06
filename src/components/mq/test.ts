// import MessageQueueConsumer from "./consume.js";
// import MessageQueueProducer from "./producer.js";
// import {MQConsumerCallback} from "./type.js";
// import {Counter} from "../counter.js";
// import {MessageQueueConnection} from "./basic.js";
//
// console.log('start\n\n')
// const producer = new MessageQueueProducer('test');
// const consumer = new MessageQueueConsumer('test');
//
// const mailLimit = Counter()
//
// const testConnection = new MessageQueueConnection();
// const test_producer = new MessageQueueProducer('test', testConnection);
// const test_consumer = new MessageQueueConsumer('test', testConnection);
//
// const process:MQConsumerCallback = (msg) => {
//     mailLimit.add();
//     if(mailLimit.get() > 80){
//         return false;
//     }
//
//     console.log(msg.content.toString());
//
//     return true;
// }
//
// for (let i = 0; i < 20; i++) {
//     await producer.send(`hello world ${i}`);
//     await test_producer.send(`test_hello world ${i}`);
// }
//
//
//
// for(let i = 0; i < 40; i++){
//     await consumer.consume(process);
//     await test_consumer.consume(process);
// }
