import { SHARE_ENV, Worker } from "worker_threads";
import Log from "../loger.js";
import bell from "../bell.js";

type WorkerStatus = "online" | "offline" | "error";

export const workerCheck = () => {
  const offlineList = RegisterService.getService("offline");
  const onlineList = RegisterService.getService("online");

  Log.info(`All ${onlineList.length} service(s) online`);
  if (offlineList.length > 0) {
    Log.error("Offline service:" + offlineList.join(","));
  }
};

export default class RegisterService {
  private static nameList: string[] = [];
  private static statusMap: Map<string, WorkerStatus> = new Map();
  private static serviceMap: Map<string, Worker> = new Map();

  public worker: Worker;
  private name: string;
  private scriptPath: string;

  static getService(status: WorkerStatus = "online") {
    return Array.from(RegisterService.statusMap)
      .filter(([_, stat]) => stat === status)
      .map(([name]) => name);
  }

  private static async updateServiceStatus(name, status: WorkerStatus) {
    RegisterService.statusMap.set(name, status);
    if (status === "error") {
      await bell(`${name} service error`);
    }
  }

  public static stopAll() {
    RegisterService.serviceMap.forEach((worker) => {
      worker.terminate();
    });
  }

  // public static rebuildService(name:string){
  //     const worker = RegisterService.serviceMap.get(name);
  //     if(worker){
  //         worker.terminate();
  //         RegisterService.serviceMap.delete(name);
  //         RegisterService.nameList = RegisterService.nameList.filter(n=>n!==name);
  //         RegisterService.statusMap.delete(name);
  //     }

  // }

  constructor(name: string, scriptPath: string, options?: WorkerOptions) {
    this.name = name;
    this.scriptPath = scriptPath;
    if (RegisterService.nameList.includes(name)) {
      Log.error("Service name repeat");
      throw new Error("Service name repeat");
    }

    RegisterService.nameList.push(name);
    RegisterService.statusMap.set(name, "offline");

    this.worker = new Worker(scriptPath, options);

    RegisterService.serviceMap.set(name, this.worker);

    this.worker.on("online", () => {
      RegisterService.updateServiceStatus(this.name, "online");
      Log.info(`${this.name} Worker online`);
    });

    this.worker.on("error", (err) => {
      RegisterService.updateServiceStatus(this.name, "error");
      Log.error(`${this.name} Worker error:${err.message}`);
    });
  }

  getStatus() {
    return RegisterService.statusMap.get(this.name);
  }
}
