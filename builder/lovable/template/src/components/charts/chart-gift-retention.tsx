import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GiftRetention } from "@/components/charts/lib/fundraising"
const cohorts = [
  { name: "2019", retained: [2840, 1136, 909, 764, 657, 578] },
  { name: "2020", retained: [4210, 1978, 1602, 1362, 1185] },
  { name: "2021", retained: [3620, 1412, 1144, 973] },
  { name: "2022", retained: [3180, 1113, 890] },
  { name: "2023", retained: [2960, 1332] },
  { name: "2024", retained: [3410] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention</CardTitle>
        <CardDescription>Cohorts, indexed to the year they joined</CardDescription>
      </CardHeader>
      <CardContent>
        <GiftRetention cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The first year is decided in the first eight weeks <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six cohorts
        </div>
      </CardFooter>
    </Card>
  )
}
