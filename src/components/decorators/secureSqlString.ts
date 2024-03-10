export function secureSqlString(target: any, propertyKey: string, descriptor: PropertyDescriptor) {

    const originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {

        const sanitizedArgs = args.map(arg => {
            // Convert all arguments to strings
            const strArg = arg.toString();
            // Sanitize the string argument
            return strArg.replace(/--/g, "")
                .replace(/'/g, "''")
                .replace(/%/g, "");
        });

        // Call the original method with sanitized arguments
        return originalMethod.apply(this, sanitizedArgs);
    };

    // Return modified descriptor
    return descriptor;
}