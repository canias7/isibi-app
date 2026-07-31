import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeatHeat } from "@/components/charts/lib/cinema"
let s = 940
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const seatRows = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L"].map((label, i) => ({
  label,
  seats: i < 2 ? 14 : i < 8 ? 18 : 16,
}))
const showings = 40
const bookings = seatRows.map((r, ri) => {
  const rowPull = ri < 3 ? 0.16 + ri * 0.08 : ri < 8 ? 0.74 - Math.abs(ri - 5) * 0.05 : 0.5
  return Array.from({ length: r.seats }, (_, si) => {
    const centre = 1 - Math.abs(si - (r.seats - 1) / 2) / ((r.seats - 1) / 2)
    return Math.round(showings * Math.min(0.97, rowPull * (0.45 + centre * 0.7)) * (0.85 + rnd() * 0.3))
  })
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the room fills</CardTitle>
        <CardDescription>One cell is one seat</CardDescription>
      </CardHeader>
      <CardContent>
        {/* the run is stated rather than inferred from the busiest seat, which
            undercounts on every room where nothing sold out */}
        <SeatHeat rows={seatRows} bookings={bookings} showings={40} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The front rows are a pricing question, not a demand one <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Forty showings
        </div>
      </CardFooter>
    </Card>
  )
}
