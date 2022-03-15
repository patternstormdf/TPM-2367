import {DynamoDB} from "@pstorm/aws-cdk"

export namespace Application {
    export const account: string = "162174280605"
    export const region: string = "us-east-1"
    export const prefixId: string = "cpaniagua-AWS-Lambda-Badge-Task-2-HTTP-API"

    export namespace Table {
        export const name: string = `${prefixId}-db-table`
        export const pkName: string = "PK"
        export const pkType: DynamoDB.Table.AttributeType = "S"
        export const skName: string = "SK"
        export const skType: DynamoDB.Table.AttributeType = "S"
        export const gsiPkName: string = "PK"
        export const gsiPkType: DynamoDB.Table.AttributeType = "S"
        export const gsiSkName: string = "Votes"
        export const gsiSkType: DynamoDB.Table.AttributeType = "N"
        export const gsiName: string = "Results"
    }
}


export function isDefined<T>(argument: T | undefined | null): argument is T {
    return (argument !== undefined) && (argument !== null)
}
