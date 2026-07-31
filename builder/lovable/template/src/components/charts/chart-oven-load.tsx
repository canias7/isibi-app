import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OvenLoad } from "@/components/charts/lib/bakery"
const bakes = [
  { name: "Sourdough 1", startMinute: 240, minutes: 45, decks: 2 },
  { name: "Baguettes", startMinute: 250, minutes: 22, decks: 1 },
  { name: "Croissants", startMinute: 260, minutes: 18, decks: 2 },
  { name: "Sourdough 2", startMinute: 290, minutes: 45, decks: 2 },
  { name: "Tin loaves", startMinute: 300, minutes: 32, decks: 1 },
  { name: "Focaccia", startMinute: 345, minutes: 25, decks: 1 },
  { name: "Pastry, second", startMinute: 380, minutes: 18, decks: 2 },
  { name: "Sourdough 3", startMinute: 410, minutes: 45, decks: 2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deck schedule</CardTitle>
        <CardDescription>Where two bakes want the same oven</CardDescription>
      </CardHeader>
      <CardContent>
        <OvenLoad bakes={bakes} decks={4} openMinute={240} closeMinute={540} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A tray list cannot show a clash <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four decks, 04:00 to 09:00
        </div>
      </CardFooter>
    </Card>
  )
}
