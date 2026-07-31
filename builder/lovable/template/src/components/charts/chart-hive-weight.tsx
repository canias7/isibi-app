import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HiveWeight } from "@/components/charts/lib/apiary"
const readings = [
  { label: "1 Jul", kg: 42.1 }, { label: "3 Jul", kg: 44.8 }, { label: "5 Jul", kg: 48.2 },
  { label: "7 Jul", kg: 51.9 }, { label: "9 Jul", kg: 54.1 }, { label: "11 Jul", kg: 53.4 },
  { label: "13 Jul", kg: 52.2 }, { label: "15 Jul", kg: 51.6 }, { label: "17 Jul", kg: 54.9 },
  { label: "19 Jul", kg: 58.7 }, { label: "21 Jul", kg: 61.4 }, { label: "23 Jul", kg: 62.1 },
  { label: "25 Jul", kg: 61.2 }, { label: "27 Jul", kg: 60.1 }, { label: "29 Jul", kg: 59.3 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hive scale</CardTitle>
        <CardDescription>The flow, derived from the weighings</CardDescription>
      </CardHeader>
      <CardContent>
        <HiveWeight readings={readings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A net 17 kg hides 22 gained and 5 eaten <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Single hive, July
        </div>
      </CardFooter>
    </Card>
  )
}
