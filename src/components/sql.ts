export function ConvertSqlValue(value:any):string{
    value = value.toString()
    value = value.replace(/--/g, "")
    value = value.replace(/'/g, "''")
    value = value.replace(/%/g, "")
    return value
}