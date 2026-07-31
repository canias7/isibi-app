import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BlockModel } from "@/components/charts/lib/mining"
let s = 17
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const blocks = Array.from({ length: 22 * 10 }, (_, i) => {
  const col = i % 22
  const row = Math.floor(i / 22)
  const lode = Math.exp(-Math.pow((col - 8 - row * 0.55) / 2.6, 2))
  return { col, row, grade: Math.round((0.06 + lode * 2.4 * (0.55 + rnd() * 0.9)) * 100) / 100 }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Block section</CardTitle>
        <CardDescription>Shaded by value, not by grade</CardDescription>
      </CardHeader>
      <CardContent>
        <BlockModel
          blocks={blocks}
          pricePerUnit={61.1}
          recovery={0.91}
          costPerT={20.1}
          tonnesPerBlock={25000}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Where the metal is and what is ore are different maps <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Section 4200E
        </div>
      </CardFooter>
    </Card>
  )
}
