import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PhishSimulation } from "@/components/charts/lib/socops"
const departments = [
  { name: "Engineering", sent: 1240, clicked: 41, reported: 380, submitted: 4 },
  { name: "Finance", sent: 310, clicked: 38, reported: 44, submitted: 11 },
  { name: "Sales", sent: 890, clicked: 142, reported: 61, submitted: 34 },
  { name: "Operations", sent: 1610, clicked: 118, reported: 214, submitted: 19 },
  { name: "Executive", sent: 42, clicked: 9, reported: 3, submitted: 2 },
  { name: "Support", sent: 2308, clicked: 196, reported: 512, submitted: 28 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phishing simulation</CardTitle>
        <CardDescription>Reports per click, not clicks alone</CardDescription>
      </CardHeader>
      <CardContent>
        <PhishSimulation departments={departments} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A team that clicks silently is a blind spot <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          6,400 messages
        </div>
      </CardFooter>
    </Card>
  )
}
