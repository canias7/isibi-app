import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WrenchTime } from "@/components/charts/lib/fieldservice"
const days = [
  { label: "Monday", travel: 2.4, diagnosis: 1.1, work: 3.2, parts: 0.6, admin: 0.7 },
  { label: "Tuesday", travel: 3.1, diagnosis: 0.8, work: 2.6, parts: 1.2, admin: 0.5 },
  { label: "Wednesday", travel: 1.6, diagnosis: 1.4, work: 4.4, parts: 0.2, admin: 0.6 },
  { label: "Thursday", travel: 2.9, diagnosis: 0.9, work: 2.9, parts: 0.9, admin: 0.8 },
  { label: "Friday", travel: 2.2, diagnosis: 1.2, work: 3.4, parts: 0.4, admin: 1.1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the day goes</CardTitle>
        <CardDescription>Hours nobody is charged for</CardDescription>
      </CardHeader>
      <CardContent>
        <WrenchTime days={days} costPerHour={38} chargeOutPerHour={84} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Full utilisation still loses money <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One engineer, one week
        </div>
      </CardFooter>
    </Card>
  )
}
