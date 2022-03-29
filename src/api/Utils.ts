import {DynamoDB} from "@pstorm/aws-cdk"
import {APIGatewayProxyEvent, Context} from "aws-lambda"
import {Endpoint} from "./Endpoint"

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
    }
}

export namespace Lambda {

    export const handler: (endpoints: Map<string, Endpoint>) => Endpoint.Handler =
        (endpoints: Map<string, Endpoint>) => async (event: APIGatewayProxyEvent, context?: Context) => {
            console.log(`=>Lambda.handler(event=${JSON.stringify(event)} context=${JSON.stringify(context)})`)
            let response: Endpoint.Response
            if (!isDefined(event)) {
                response = {
                    statusCode: 400,
                    body: JSON.stringify({error: "event is undefined"})
                }
            } else {
                const endpointKey: string = Endpoint.key(event.resource, event.httpMethod as Endpoint.Method)
                const endpoint: Endpoint | undefined = endpoints.get(endpointKey)
                if (!isDefined(endpoint)) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: `method=${event.httpMethod} on resource=${event.resource} is not supported`})
                    }
                } else {
                    response = await endpoint.execute(event)
                }
            }
            console.log(`<=Lambda.handler output=${JSON.stringify(response)}`)
            return response
        }
}


export function isDefined<T>(argument: T | undefined | null): argument is T {
    return (argument !== undefined) && (argument !== null)
}
