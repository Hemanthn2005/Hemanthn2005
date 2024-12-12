#include<stdio.h>
#include<stdlib.h>
#define max 100
int parent[max],low[max],dfn[max],articulation[max],visited[max],time=0;
void dfnlow(int u,int adj[max][max],int V){
	int children=0,v;
	visited[u]=-1;
	low[u]=dfn[u]=++time;
	for(v=0;v<V;v++){
		if(adj[u][v]){
			if(!visited[v]){
				children++;
				parent[v]=u;
				dfnlow(v,adj,V);
				low[u]=(low[u]<low[v])?low[u]:low[v];
				if(parent[u]==-1&&children>1)
				articulation[u]=1;
				if(parent[u]!=-1&&low[u]>=dfn[v])
				articulation[u]=1;
			}
			if(v!=parent[u]){
				low[u]=(low[u]<dfn[v])?low[u]:dfn[v];
			}
		}
	}
}
void findarticulationpoints(int adj[max][max],int V){
	int i;
	for(i=0;i<V;i++){
		parent[i]=-1;
		articulation[i]=0;
		visited[i]=0;
	}
	for(i=0;i<V;i++){
		if(!visited[i]){
			dfnlow(i,adj,V);
		}	
	}
	printf("articulation points are:");
	for(i=0;i<V;i++){
		
		if(articulation[i]){
		
			printf("router %d",i);
		}
		
	}
}
int main(){
	int V,E,u,v,adj[max][max]={0};
	printf("enter the vertices");
	scanf("%d",&V);
	printf("enter the edges");
	scanf("%d",&E);
	printf("enter the u and v connections");
	for(int i=0;i<E;i++){
		scanf("%d%d",&u,&v);
	}
	findarticulationpoints(adj,V);
	return 0;
}
