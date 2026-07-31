import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DockToStock } from "@/components/charts/lib/warehouse"
const stages = [
  { name: "Waiting to unload", queueShare: 0.94 },
  { name: "Unload", queueShare: 0.08 },
  { name: "Awaiting check", queueShare: 0.88 },
  { name: "Goods in check", queueShare: 0.12 },
  { name: "Putaway queue", queueShare: 0.91 },
  { name: "Putaway", queueShare: 0.1 },
]
const receipts = [
  { reference: "GRN-8841", hours: [1.4, 0.9, 3.2, 1.1, 2.6, 0.8] },
  { reference: "GRN-8842", hours: [3.8, 1.2, 5.4, 1.4, 4.1, 1.0] },
  { reference: "GRN-8843", hours: [0.6, 0.7, 1.8, 0.9, 1.4, 0.6] },
  { reference: "GRN-8844", hours: [2.2, 1.1, 4.6, 1.2, 6.8, 0.9] },
  { reference: "GRN-8845", hours: [1.1, 0.8, 2.4, 1.0, 2.0, 0.7] },
  { reference: "GRN-8846", hours: [5.6, 1.4, 7.2, 1.6, 5.4, 1.2] },
  { reference: "GRN-8847", hours: [0.9, 0.6, 2.1, 0.8, 1.7, 0.6] },
  { reference: "GRN-8848", hours: [2.8, 1.0, 3.9, 1.1, 3.2, 0.8] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dock to stock</CardTitle>
        <CardDescription>Queue split out from work</CardDescription>
      </CardHeader>
      <CardContent>
        <DockToStock receipts={receipts} stages={stages} targetHours={12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Buying speed fixes nothing while a pallet waits <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight receipts
        </div>
      </CardFooter>
    </Card>
  )
}
