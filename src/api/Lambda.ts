import {APIGatewayProxyEvent, Context} from "aws-lambda"
import {Vote} from "./Vote"
import {Result} from "./Result"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"



const endpoints: Map<string, Endpoint> = new Map()
endpoints.set(Vote.Create.endpoint.key, Vote.Create.endpoint)
endpoints.set(Vote.Close.endpoint.key, Vote.Close.endpoint)
endpoints.set(Result.Get.endpoint.key, Result.Get.endpoint)

export async function handler(event: APIGatewayProxyEvent, context?: Context): Promise<any> {
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
