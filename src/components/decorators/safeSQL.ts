const strCheck = (str: string) => {
  return str.replace(/--/g, "").replace(/'/g, "''").replace(/%/g, "");
};

const objCheck = (obj: any) => {
  for (let key in obj) {
    if (obj[key] && typeof obj[key] === "string") {
      obj[key] = strCheck(obj[key]);
    }
    if (obj[key] && typeof obj[key] === "object") {
      obj[key] = objCheck(obj[key]);
    }
  }
  return obj;
};

export function safeSQL(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const sanitizedArgs = args.map((arg) => {
      if (typeof arg === "string") {
        return strCheck(arg);
      }
      if (typeof arg === "object") {
        return objCheck(arg);
      }
      return arg;
    });
    return originalMethod.apply(this, sanitizedArgs);
  };

  return descriptor;
}
