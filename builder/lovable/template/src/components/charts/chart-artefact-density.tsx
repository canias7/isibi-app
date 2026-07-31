import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArtefactDensity } from "@/components/charts/lib/archaeology"
const contexts = [
  { name: "101 topsoil", finds: 412, volumeM3: 18.4 },
  { name: "105 pit fill", finds: 168, volumeM3: 1.2 },
  { name: "107 yard surface", finds: 240, volumeM3: 9.6 },
  { name: "112 midden", finds: 96, volumeM3: 0.7 },
  { name: "118 ditch fill", finds: 74, volumeM3: 4.1 },
  { name: "121 buried soil", finds: 51, volumeM3: 6.8 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Find density</CardTitle>
        <CardDescription>Finds per cubic metre, not per context</CardDescription>
      </CardHeader>
      <CardContent>
        <ArtefactDensity contexts={contexts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The biggest count is not the richest deposit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six contexts
        </div>
      </CardFooter>
    </Card>
  )
}
