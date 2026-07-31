import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LinkBudget } from "@/components/charts/lib/telecom"
const elements = [
  { name: "Feeder loss", db: -1.8 },
  { name: "Tx antenna", db: 24 },
  { name: "Path loss", db: -138.4 },
  { name: "Rain fade", db: -6.2 },
  { name: "Rx antenna", db: 24 },
  { name: "Rx feeder", db: -1.4 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link budget</CardTitle>
        <CardDescription>Every gain and loss to the receiver</CardDescription>
      </CardHeader>
      <CardContent>
        <LinkBudget transmitDbm={33} elements={elements} sensitivityDbm={-78} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Free-space path loss is the whole story <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Point to point
        </div>
      </CardFooter>
    </Card>
  )
}
