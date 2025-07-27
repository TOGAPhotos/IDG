export function GetTimeStamp() {
  return new Date().getTime();
}

export default class Time {
  static getTimeStamp() {
    return new Date().getTime();
  }

  static getDateTime() {
    return new Date().toLocaleString();
  }
  static getUTCTime() {
    return new Date().toUTCString();
  }
}
