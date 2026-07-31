import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EloHistory } from "@/components/charts/lib/gamesmusic"
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
const players = [
  { name: "Okonkwo", ratings: [1720, 1748, 1795, 1782, 1834, 1861] },
  { name: "Brandt", ratings: [1810, 1792, 1770, 1801, 1788, 1812] },
  { name: "Sørensen", ratings: [1490, 1552, 1601, 1648, 1690, 1744] },
  { name: "Aziz", ratings: [1385, 1402, 1440, 1412, 1468, 1495] },
].map((p) => ({ name: p.name, ratings: p.ratings.map((rating, i) => ({ period: months[i], rating })) }))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ratings over the season</CardTitle>
        <CardDescription>Four players, one scale</CardDescription>
      </CardHeader>
      <CardContent>
        <EloHistory players={players} provisionalBelow={1500} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The shaded band is provisional <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Elo
        </div>
      </CardFooter>
    </Card>
  )
}
