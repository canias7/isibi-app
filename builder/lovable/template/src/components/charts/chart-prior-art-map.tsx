import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PriorArtMap } from "@/components/charts/lib/patents"
const elements = ["Capacitive sensor", "Processor", "200 Hz sampling", "Moving window", "Discard outliers", "Wireless report"]
const references = [
  { id: "US 9,412,331", date: "2016" },
  { id: "EP 2 884 112", date: "2015" },
  { id: "WO 2013/094882", date: "2013" },
  { id: "JP 5,998,201", date: "2016" },
  { id: "Nakamura 2014", date: "2014" },
]
const disclosure = [
  [2, 2, 1, 0, 0, 2],
  [2, 2, 0, 0, 0, 1],
  [1, 2, 2, 1, 0, 0],
  [2, 1, 1, 0, 0, 2],
  [1, 2, 2, 2, 0, 1],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prior art</CardTitle>
        <CardDescription>Every reference against every claim element</CardDescription>
      </CardHeader>
      <CardContent>
        <PriorArtMap elements={elements} references={references} disclosure={disclosure} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One element nothing discloses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Claim 1, six elements
        </div>
      </CardFooter>
    </Card>
  )
}
