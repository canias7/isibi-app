import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdmissionsDecay } from "@/components/charts/lib/cinema"
const titles = [
  { name: "Franchise sequel", weekly: [42000, 18900, 9450, 5100, 2900, 1740, 1090] },
  { name: "Family animation", weekly: [21000, 16800, 13100, 10200, 7900, 6000, 4500] },
  { name: "Awards drama", weekly: [4800, 5300, 6100, 5400, 4300, 3200, 2400] },
  { name: "Horror opener", weekly: [26000, 8400, 3200, 1300, 560, 250, 120] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly drop</CardTitle>
        <CardDescription>A constant drop is a straight line here</CardDescription>
      </CardHeader>
      <CardContent>
        <AdmissionsDecay titles={titles} minimumWeekly={800} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The shape of the curve is information, not arithmetic <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log scale
        </div>
      </CardFooter>
    </Card>
  )
}
