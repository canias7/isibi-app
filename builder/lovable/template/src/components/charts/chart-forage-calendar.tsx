import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ForageCalendar } from "@/components/charts/lib/apiary"
const sources = [
  { name: "Willow", fromWeek: 10, toWeek: 14, strength: 1.4 },
  { name: "Dandelion", fromWeek: 13, toWeek: 19, strength: 1.8 },
  { name: "Oilseed rape", fromWeek: 16, toWeek: 21, strength: 2.6 },
  { name: "Hawthorn", fromWeek: 19, toWeek: 22, strength: 1.2 },
  { name: "Sycamore", fromWeek: 17, toWeek: 20, strength: 1.5 },
  { name: "Bramble", fromWeek: 25, toWeek: 32, strength: 2.1 },
  { name: "Lime", fromWeek: 26, toWeek: 29, strength: 1.9 },
  { name: "Heather", fromWeek: 32, toWeek: 37, strength: 2.2 },
  { name: "Ivy", fromWeek: 38, toWeek: 43, strength: 1.6 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forage</CardTitle>
        <CardDescription>What is in flower, and when nothing is</CardDescription>
      </CardHeader>
      <CardContent>
        <ForageCalendar sources={sources} weeks={34} startWeek={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The June gap is what an apiary plants for <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weeks 10 to 43
        </div>
      </CardFooter>
    </Card>
  )
}
