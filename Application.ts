import {Application, Lambda, ApiGateway, DynamoDB, IAM} from "@pstorm/aws-cdk"
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import {Application as App} from "./src/Utils"

const tags: Application.Resource.Tag[] = [
    {key: "owner", value : "claudi.paniagua@devfactory.com"},
    {key: "purpose", value: "https://devgraph-alp.atlassian.net/browse/TPM-2367"}
]

export const app = Application.new( `${App.prefixId}-app`, App.account, App.region,"Application.ts")

const table: DynamoDB.Table = DynamoDB.Table.new(App.Table.name, tags,
    App.Table.pkName, App.Table.pkType, App.Table.skName, App.Table.skType)

app.addResource(table)

const lambdaPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem", "dynamodb:Query"],
    "Allow",
    [table]
)
const lambda: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda`, "src", tags, "Lambda.handler", undefined, lambdaPermissions, 50)
app.addResource(lambda)

const restApi: ApiGateway.API.REST.Lambda = ApiGateway.API.REST.Lambda.new(`${App.prefixId}-api-gw`, lambda, tags)
const restApiInstance: ApiGateway.API.REST.Lambda.Instance = app.addResource(restApi) as ApiGateway.API.REST.Lambda.Instance
const restApiRoot: apigw.IResource = (restApiInstance.asConstruct as apigw.IRestApi).root
const vote: apigw.IResource = restApiRoot.addResource("vote")
vote.addMethod("POST")
const result: apigw.IResource = restApiRoot.addResource("result")
result.addMethod("GET")



