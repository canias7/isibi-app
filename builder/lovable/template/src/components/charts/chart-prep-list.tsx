import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrepList } from "@/components/charts/lib/restaurant"
const stations = [
  { name: "Larder", tasks: [
    { name: "Caesar dressing", minutes: 24, done: true }, { name: "Pickled shallot", minutes: 36 },
    { name: "Terrine slice", minutes: 40 }, { name: "Herb oil", minutes: 18 },
    { name: "Salad wash", minutes: 55 }, { name: "Crudité", minutes: 45 },
  ] },
  { name: "Sauce", tasks: [
    { name: "Demi-glace", minutes: 64 }, { name: "Beurre blanc", minutes: 22, done: true },
    { name: "Jus reduction", minutes: 38 },
  ] },
  { name: "Grill", tasks: [
    { name: "Portion ribeye", minutes: 30, done: true }, { name: "Confit duck", minutes: 48 },
    { name: "Marinade", minutes: 15 },
  ] },
  { name: "Pastry", tasks: [
    { name: "Focaccia", minutes: 70 }, { name: "Ice cream base", minutes: 26, done: true },
    { name: "Tart shells", minutes: 44 },
  ] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prep board</CardTitle>
        <CardDescription>Every task against the minutes left before service</CardDescription>
      </CardHeader>
      <CardContent>
        <PrepList stations={stations} minutesToService={180} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Larder cannot finish in the time it has <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Friday, 15:00
        </div>
      </CardFooter>
    </Card>
  )
}
