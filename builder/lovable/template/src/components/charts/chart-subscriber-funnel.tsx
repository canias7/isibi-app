import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SubscriberFunnel } from "@/components/charts/lib/podcast"
const steps = [
  { name: "Ad click", people: 42800 },
  { name: "Landing page", people: 31600 },
  { name: "Opened an app", people: 12400 },
  { name: "Played episode", people: 9200 },
  { name: "Finished one", people: 4100 },
  { name: "Followed", people: 2840 },
  { name: "Two more episodes", people: 1320 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriber funnel</CardTitle>
        <CardDescription>Loss at each step, not overall</CardDescription>
      </CardHeader>
      <CardContent>
        <SubscriberFunnel steps={steps} costPerClick={0.42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The worst rate and the biggest loss are different steps <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One campaign
        </div>
      </CardFooter>
    </Card>
  )
}
