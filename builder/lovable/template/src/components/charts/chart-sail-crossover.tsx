import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SailCrossover } from "@/components/charts/lib/sailing"
const winds = [6, 8, 10, 12, 14, 16, 18, 20, 24, 28]
const sails = [
  { name: "A2 running", speeds: [4.6, 5.4, 6.1, 6.7, 7.2, 7.5, 7.7, null, null, null] },
  { name: "A3 reaching", speeds: [4.2, 5.1, 5.9, 6.6, 7.3, 7.8, 8.1, 8.3, 8.4, null] },
  { name: "Code 0", speeds: [4.9, 5.6, 6.0, 6.3, 6.6, 6.8, 6.9, 7.0, null, null] },
  { name: "Jib and main", speeds: [3.4, 4.2, 5.0, 5.7, 6.3, 6.8, 7.2, 7.6, 8.1, 8.3] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sail crossover</CardTitle>
        <CardDescription>Where two speed curves actually cross</CardDescription>
      </CardHeader>
      <CardContent>
        <SailCrossover winds={winds} sails={sails} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One crossing is not worth the trip forward <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Downwind, 140° true
        </div>
      </CardFooter>
    </Card>
  )
}
