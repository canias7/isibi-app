import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SurgeResponse } from "@/components/charts/lib/taxi"
const intervals = [
  { label: "20:00", multiplier: 1, carsOnline: 84, requests: 71 },
  { label: "20:30", multiplier: 1, carsOnline: 86, requests: 79 },
  { label: "21:00", multiplier: 1.1, carsOnline: 88, requests: 94 },
  { label: "21:30", multiplier: 1.4, carsOnline: 91, requests: 118 },
  { label: "22:00", multiplier: 1.8, carsOnline: 94, requests: 146 },
  { label: "22:30", multiplier: 2.2, carsOnline: 97, requests: 171 },
  { label: "23:00", multiplier: 2.6, carsOnline: 99, requests: 188 },
  { label: "23:30", multiplier: 2.4, carsOnline: 101, requests: 174 },
  { label: "00:00", multiplier: 1.9, carsOnline: 98, requests: 149 },
  { label: "00:30", multiplier: 1.5, carsOnline: 94, requests: 121 },
  { label: "01:00", multiplier: 1.2, carsOnline: 89, requests: 96 },
  { label: "01:30", multiplier: 1, carsOnline: 82, requests: 74 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Surge</CardTitle>
        <CardDescription>Did any cars actually turn up</CardDescription>
      </CardHeader>
      <CardContent>
        <SurgeResponse intervals={intervals} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A signal that moves nothing is a price rise <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Saturday night
        </div>
      </CardFooter>
    </Card>
  )
}
