import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpanOfControl } from "@/components/charts/lib/hr"
const managers = [
  { name: "Okonkwo", reports: 2, level: 3 }, { name: "Brandt", reports: 3, level: 4 },
  { name: "Costa", reports: 5, level: 4 }, { name: "Dlamini", reports: 6, level: 5 },
  { name: "Erikson", reports: 7, level: 5 }, { name: "Farouk", reports: 8, level: 5 },
  { name: "Gupta", reports: 11, level: 5 }, { name: "Haugen", reports: 14, level: 6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct reports per manager</CardTitle>
        <CardDescription>Too narrow and too wide</CardDescription>
      </CardHeader>
      <CardContent>
        <SpanOfControl managers={managers} narrow={3} wide={9} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Both ends are a structure problem <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One division
        </div>
      </CardFooter>
    </Card>
  )
}
