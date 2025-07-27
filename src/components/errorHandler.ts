import Log from "./loger.js";

export default class ErrorHandler {
  static syncError(err: Error) {
    Log.error(err.message + "\n" + err.stack);
  }

  static asyncError(reason: Error) {
    Log.error(reason.message + "\n" + reason.stack);
  }
}
