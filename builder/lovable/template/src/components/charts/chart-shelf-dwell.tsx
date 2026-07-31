import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShelfDwell } from "@/components/charts/lib/libraries"
const sections = [
  { name: "Adult fiction", bands: [3200, 2800, 1900, 1100, 900] },
  { name: "Children's", bands: [4100, 2600, 1200, 640, 380] },
  { name: "Adult non-fiction", bands: [1400, 1900, 2100, 2400, 4200] },
  { name: "Reference", bands: [180, 260, 340, 520, 2900] },
  { name: "Large print", bands: [420, 610, 480, 390, 640] },
  { name: "Audiobooks", bands: [980, 720, 410, 260, 180] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shelf dwell</CardTitle>
        <CardDescription>The distribution, not the average</CardDescription>
      </CardHeader>
      <CardContent>
        <ShelfDwell sections={sections} deadAfterDays={365} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A third untouched behind a respectable mean <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By section
        </div>
      </CardFooter>
    </Card>
  )
}
