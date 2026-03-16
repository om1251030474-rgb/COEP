import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Trash2, Plus } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL;

export default function AdminDashboard() {

const [drones,setDrones] = useState([]);
const [name,setName] = useState("");
const [model,setModel] = useState("");
const [lat,setLat] = useState("");
const [lng,setLng] = useState("");

useEffect(()=>{
 fetchDrones();
},[])

const fetchDrones = async()=>{
 const res = await axios.get(`${API_URL}/api/drones`);
 setDrones(res.data);
}

const addDrone = async()=>{
 await axios.post(`${API_URL}/api/admin/drones/add`,{
   name,
   model,
   lat:parseFloat(lat),
   lng:parseFloat(lng)
 });
 fetchDrones();
}

const removeDrone = async(id)=>{
 await axios.delete(`${API_URL}/api/admin/drones/${id}`);
 fetchDrones();
}

return(
<div className="min-h-screen bg-[#020617] text-white p-8">

<h1 className="text-3xl font-bold mb-6">
Drone Admin Control
</h1>

{/* ADD DRONE */}

<div className="glass-panel p-6 mb-6">

<h2 className="text-xl mb-4">Add Drone</h2>

<div className="grid grid-cols-4 gap-4">

<Input placeholder="Drone Name" onChange={e=>setName(e.target.value)} />
<Input placeholder="Model" onChange={e=>setModel(e.target.value)} />
<Input placeholder="Latitude" onChange={e=>setLat(e.target.value)} />
<Input placeholder="Longitude" onChange={e=>setLng(e.target.value)} />

</div>

<Button className="mt-4" onClick={addDrone}>
<Plus className="w-4 h-4 mr-2"/>
Add Drone
</Button>

</div>


{/* DRONE TABLE */}

<div className="glass-panel p-6">

<h2 className="text-xl mb-4">Drone Fleet</h2>

<table className="w-full">

<thead>
<tr className="text-left text-slate-400">
<th>Name</th>
<th>Model</th>
<th>Battery</th>
<th>Altitude</th>
<th>Status</th>
<th>Action</th>
</tr>
</thead>

<tbody>

{drones.map(d=>(
<tr key={d.id} className="border-t border-white/10">

<td>{d.name}</td>
<td>{d.model}</td>
<td>{Math.round(d.battery)}%</td>
<td>{d.altitude || 0} m</td>
<td>{d.status}</td>

<td>
<Button
variant="destructive"
size="sm"
onClick={()=>removeDrone(d.id)}
>
<Trash2 className="w-4 h-4"/>
</Button>
</td>

</tr>
))}

</tbody>
</table>

</div>

</div>
)
}