import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClaimScope } from "@/components/charts/lib/patents"
const versions = [
  { label: "As filed", date: "2018-04", limitations: ["a sensor", "a processor", "generating a signal"] },
  { label: "First response", date: "2020-01", limitations: ["a sensor", "a processor", "generating a signal", "wherein the sensor is capacitive"] },
  { label: "Second response", date: "2021-06", limitations: ["a sensor", "a processor", "generating a signal", "wherein the sensor is capacitive", "sampling at above 200 Hz"] },
  { label: "As granted", date: "2022-03", limitations: ["a sensor", "a processor", "generating a signal", "wherein the sensor is capacitive", "sampling at above 200 Hz", "and discarding samples outside a moving window"] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim narrowing</CardTitle>
        <CardDescription>Limitations added through prosecution</CardDescription>
      </CardHeader>
      <CardContent>
        <ClaimScope versions={versions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every limitation is a way around the claim <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Claim 1
        </div>
      </CardFooter>
    </Card>
  )
}
